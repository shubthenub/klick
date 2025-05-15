export const getFileTypeFromUrl = (url) => {
    if (!url) return null;
    
    // Handle Base64 image or video
    if (url.startsWith("data:image/")) return "image";
    if (url.startsWith("data:video/")) return "video";

    // Remove query parameters (`?key=value`) and fragments (`#something`)
    const cleanUrl = url.split("?")[0].split("#")[0];

    // Extract the extension and convert it to lowercase
    const parts = cleanUrl.split(".");
    if (parts.length < 2) return "unknown"; // No extension found

    const extension = parts.pop().toLowerCase();

    switch (extension) {
        case "jpg":
        case "jpeg":
        case "png":
        case "gif":
            return "image";
        case "mp4":
        case "webm":
        case "mov":
        case "avi":
            return "video";
        default:
            return "unknown";
    }
};

export const checkForTrends = (postText) => {
    //check for single word after a hashtag
    const firstSplit =postText
    .trim()
    .split(/\s+/)
    .filter((word) => word.startsWith("#"))
    .map((word) => word.slice(1).toLowerCase());

    let res=firstSplit;

    //check for words having multiple hashtags
    firstSplit.map((word)=>{
        const secondSplit = word.split("#");
        if(secondSplit.length>1){
            res=[...res, ...secondSplit.slice(1,secondSplit.length)].filter(
                (el)=>el!==word
            )
        }
    });

    //since destructuring is done, we need to remove duplicates
    res=[...new Set(res)];
    return res
} 