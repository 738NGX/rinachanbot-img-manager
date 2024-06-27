import fs from 'fs';
import path from 'path';

export function ImagerPicker(basePath: string, gallery: string, count: number) {
    const files = fs.readdirSync(path.join(basePath, gallery));
    
    if (count > files.length) {
        count = files.length;
    }
    
    const selectedFiles = [];
    const usedIndices = new Set();

    while (selectedFiles.length < count) {
        const randomIndex = Math.floor(Math.random() * files.length);
        if (!usedIndices.has(randomIndex)) {
            usedIndices.add(randomIndex);
            selectedFiles.push(files[randomIndex]);
        }
    }

    return selectedFiles;
}