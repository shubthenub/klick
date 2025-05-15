import cloudinary from 'cloudinary';

cloudinary.config({
    cloud_name : "dfxdudq7o",
    api_key : "735663547944244",
    api_secret : "ev_DMOP8QcRk7vjWcPS9UCjChDU" 
});

export const cld = globalThis.cloudinary || cloudinary;

if(process.env.NODE_ENV !=="production") globalThis.cloudinary = cld;