import { Context, Schema, Logger, h, Database, Model } from 'koishi'
import fs from 'fs';
import * as ImageSave from './ImageSave';
import { ImagerPicker } from './ImageLoad';
import { pathToFileURL } from 'url'
import { join } from 'path'

export const name = 'rinachanbot-img-manager'
export const logger = new Logger('rinachanbot-img-manager');
export const inject = {
    required: ['database'],
    optional: [],
}

declare module 'koishi' {
    interface Context {
        model: any
        database: any
    }
}

export interface Config {
    defaultImageExtension: string
    galleryPath: string
    maxout: number
    consoleinfo: boolean
}

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        galleryPath: Schema.string().description('图库根目录').default(null).required(),
        defaultImageExtension: Schema.string().description("默认图片后缀名").default("jpg"),
        maxout: Schema.number().description('一次最大输出图片数量').default(10),
    }).description('基本设置'),
    Schema.object({
        consoleinfo: Schema.boolean().description("开启后将在控制台输出日志").default(false),
    }).description('调试设置'),
])

export function apply(ctx: Context, config: Config) {
    // 图库数据库
    ctx.model.extend('rina.gallery', {
        id: 'unsigned',
        path: 'string',
    }, { primaryKey: 'id', autoInc: true });

    ctx.model.extend('rina.galleryName', {
        id: 'unsigned',
        name: 'string',
        galleryId: 'unsigned',
    }, { primaryKey: 'id', autoInc: true });

    // 新建图库
    ctx.command('rinachanbot/新建图库 <name:string> [...rest]', '新建一个图库')
        .action(async ({ session }, name, ...rest) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 检查是否存在同名图库
            let duplicate = await ctx.database.get('rina.galleryName', { name: [name], })
            if (duplicate.length != 0) { return '图库已存在[X﹏X]'; }

            let newGallery = await ctx.database.create('rina.gallery', { path: name })
            let newGalleryName = await ctx.database.create('rina.galleryName', { name: name, galleryId: newGallery.id })
            await fs.promises.mkdir(config.galleryPath + "/" + name, { recursive: true });

            // 多个图库的创建
            if (rest.length > 0) {
                for (const rest_name of rest) {
                    duplicate = await ctx.database.get('rina.galleryName', { name: [rest_name], })
                    if (duplicate.length != 0) { return `图库${rest_name}已存在[X﹏X]`; }
                    newGallery = await ctx.database.create('rina.gallery', { path: rest_name })
                    newGalleryName = await ctx.database.create('rina.galleryName', { name: rest_name, galleryId: newGallery.id })
                    await fs.promises.mkdir(config.galleryPath + "/" + rest_name, { recursive: true });
                }
            }

            let prefix = rest.length > 0 ? `${rest.length + 1}个` : ''
            return `${prefix}图库创建成功! [=^▽^=]`;
        });

    // 关联图库
    ctx.command('rinachanbot/关联图库 <name:string> <gallery:string>', '关联一个名称到已有图库')
        .action(async ({ session }, name, gallery) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 检查是否存在同名图库
            const duplicate = await ctx.database.get('rina.galleryName', { name: [name], })
            if (duplicate.length != 0) { return '名称已存在[X﹏X]'; }

            // 检查图库是否存在
            const galleryId = await ctx.database.get('rina.gallery', { path: [gallery], })
            if (galleryId.length == 0) { return '图库不存在[X﹏X]'; }

            const newGalleryName = await ctx.database.create('rina.galleryName', { name: name, galleryId: galleryId[0].id })
            return '关联成功! [=^▽^=]';
        });

    // 加图
    ctx.command('rinachanbot/加图 <name:string> [filename:string]', '保存图片到指定图库')
        .option('ext', '-e <ext:string>')
        .option('name', '-n <name:string>')
        .action(async ({ session, options }, name, filename) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 选择图库
            const selected = await ctx.database.get('rina.galleryName', { name: [name], });
            if (selected.length == 0) return '不存在的图库,请重新输入或新建/关联图库[X﹏X]';
            const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[0].galleryId], });
            const selectedPath = join(config.galleryPath, selectedSubPath[0].path);

            // 文件名处理
            let safeFilename: string;
            if (options.name) {
                // 如果启用了 -n 选项，则使用用户提供的文件名
                safeFilename = options.name;
            } else if (!filename) {
                // 如果未指定文件名，则生成默认文件名，是【年-月-日-小时-分】
                const date = new Date();
                safeFilename = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}`;
            } else {
                // 使用用户指定的文件名
                safeFilename = filename;
            }

            // 处理中文文件名
            const imageExtension = options.ext || config.defaultImageExtension;
            safeFilename = safeFilename.replace(/[\u0000-\u001f\u007f-\u009f\/\\:*?"<>|]/g, '_'); // 移除不安全字符

            // 获取图片
            await session.send('请发送图片[≧▽≦]');
            const image = await session.prompt(30000);

            // 提取图片URL
            if (config.consoleinfo) {
                logger.info('用户输入： ' + image);
            }
            const urlhselect = h.select(image, 'img').map(item => item.attrs.src);
            if (!urlhselect) return '无法提取图片URL[X﹏X]';

            // 调用 saveImages 函数保存图片
            try {
                await ImageSave.saveImages(urlhselect, selectedPath, safeFilename, imageExtension, config, session, ctx);
            } catch (error) {
                return `保存图片时出错[X﹏X]：${error.message}`;
            }
        });

    // 璃奈板
    ctx.command('rinachanbot/璃奈板 <name:string> [count:number]', '随机输出图片')
        .action(async ({ session }, name, count) => {
            if (!name) return '请输入图库名[X﹏X]';

            // 处理数量
            if (!count) count = 1
            if (count > config.maxout) count = config.maxout

            // 匹配图库
            const selected = await ctx.database.get('rina.galleryName', { name: [name], });
            if (selected.length == 0) return '不存在的图库[X﹏X]';
            const index = selected.length == 1 ? 0 : Math.floor(Math.random() * selected.length);
            const selectedSubPath = await ctx.database.get('rina.gallery', { id: [selected[index].galleryId], });
            const gallery = selectedSubPath[0].path;

            // 选择图片
            let pickeed = ImagerPicker(config.galleryPath, gallery, count)
            let res = []
            for (const fname of pickeed) {
                const p = join(config.galleryPath, gallery, fname)
                res.push(h.image(pathToFileURL(p).href))
            }

            return res
        });
}
