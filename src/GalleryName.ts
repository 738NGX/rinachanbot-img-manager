import { Tables, Session } from 'koishi'

declare module 'koishi' {
    interface Tables {
        gallery: Gallery
        galleryName: GalleryName
    }
}

export interface Gallery {
    id: number
    path: string
}

export interface GalleryName {
    id: number
    name: string
    galleryId: number
}