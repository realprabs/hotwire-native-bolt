export function locationWithActionIsSamePage(location: URL) {
	return location.href === window.location.href
}

export function scrollToAnchorFromLocation(location: URL) {
	location.hash && document.querySelector(location.hash)?.scrollIntoView()
}

export function uuid() {
	return Array.from({ length: 36 })
		.map((_, i) => {
			if (i == 8 || i == 13 || i == 18 || i == 23) {
				return '-'
			} else if (i == 14) {
				return '4'
			} else if (i == 19) {
				return (Math.floor(Math.random() * 4) + 8).toString(16)
			} else {
				return Math.floor(Math.random() * 15).toString(16)
			}
		})
		.join('')
}

export function canNavigate(url: URL) {
	if (!window.HotwireNavigator.enabled) return false

	const fileExtensions = [
		'.7z',
		'.aac',
		'.apk',
		'.avi',
		'.bmp',
		'.bz2',
		'.css',
		'.csv',
		'.deb',
		'.dmg',
		'.doc',
		'.docx',
		'.exe',
		'.gif',
		'.gz',
		'.heic',
		'.heif',
		'.ico',
		'.iso',
		'.jpeg',
		'.jpg',
		'.js',
		'.json',
		'.m4a',
		'.mkv',
		'.mov',
		'.mp3',
		'.mp4',
		'.mpeg',
		'.mpg',
		'.msi',
		'.ogg',
		'.ogv',
		'.pdf',
		'.pkg',
		'.png',
		'.ppt',
		'.pptx',
		'.rar',
		'.rtf',
		'.svg',
		'.tar',
		'.tif',
		'.tiff',
		'.txt',
		'.wav',
		'.webm',
		'.webp',
		'.wma',
		'.wmv',
		'.xls',
		'.xlsx',
		'.xml',
		'.zip',
	]

	const hasFileExtension = fileExtensions.some((ext) =>
		url.pathname.endsWith(ext)
	)
	return url.origin === window.location.origin && !hasFileExtension
}
