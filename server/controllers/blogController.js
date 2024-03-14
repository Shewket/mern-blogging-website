import fs from 'fs';
import {nanoid} from 'nanoid';
import { exec, spawn } from 'child_process';
import Blog from '../Schema/Blog.js';
import User from '../Schema/User.js';

const DESCRIPTION_LIMIT = 500;
const TAGS_LIMIT = 10;


const upLoadImages =(req, res)  => {

    // console.log(req.files);

    const uploadedFiles = [];

    for(let i = 0; i < req.files.length; i++) {
        const {path, originalname} = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const  newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace('uploads\\',''));

    }
    res.json(uploadedFiles);

}



const createBlog = (req, res) => {
    
    let authorId = req.user;

    let {title, des, banner, tags, content, draft} = req.body;
    

    if(!title.length){
        return res.status(403).json({"error": "Title is required."});
    }

    if(!draft){
        if(!des.length || des.length > DESCRIPTION_LIMIT){
            return res.status(403).json({"error": "Description is required under 500 characters."});
        }
    
        if(!banner.length){
            return res.status(403).json({"error": "Banner is required."});
        }
    
        if(!content.blocks.length){
            return res.status(403).json({"error": "Content is required."});
        }
    
        if(!tags.length || tags.length > TAGS_LIMIT) {
            return res.status(403).json({"error": "Tags is required, Maxium 10."});
        }
    }

    tags = tags.map(tag => tag.toLowerCase());

    let blog_id = title.replace(/[^a-zA-Z0-9]/g, ' ').replace(/\s+/g, '-').trim() + nanoid();
    
    let blog = new Blog({
        title, des, banner, content, tags, author: authorId, blog_id: blog_id, draft: Boolean(draft) 
    })

    blog.save().then(blog => {
        let increamentVal = draft ? 0 : 1;

        User.findOneAndUpdate({_id: authorId}, {$inc: {"account_info.total_posts": increamentVal}, $push: {"blogs": blog._id}})
            .then(user => {
                return res.status(200).json({id: blog.blog_id})
            })
            .catch(err => {
                return res.status(500).json({error: "Failed to update total posts number."})
            })
    })
    .catch(err => {
        return res.status(500).json({error: "Failed to create blog: " + err.message  })
    })

}

const getLatestBlogs = (req, res) => {

    let {page} = req.body;

    const maxLimit = 5;

    Blog.find({draft: false})
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({"publishedAt": -1})
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page -1) * maxLimit)
    .limit(maxLimit)
    .then(blogs => {
        return res.status(200).json({blogs});
    })
    .catch(err => {
        return res.status(500).json({"error": err.message });
    })
}

const getTrendingBlogs = (req, res) => {
    Blog.find({ draft: false })
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({ "activity.total_read ": -1, "activity.total_likes": -1, "publishedAt": -1})
    .select("blog_id title publishedAt -_id")
    .limit(5)
    .then(blogs => {
        return res.status(200).json({ blogs });
    })
    .catch(err => {
        return res.status(500).json({ "error": err.message });
    })
    
}

const getSearchingBlogs = (req, res) => {
    let {tag, query, author, page, limit, eliminate_blog} = req.body;

    let findQuery;

    let maxLimit = limit ? limit : 1;

    if(tag){
        findQuery = {tags: tag, draft: false, blog_id: {$ne: eliminate_blog}};
    } else if(query){
        findQuery = {draft: false, title: new RegExp(query, 'i')}
    } else if(author){
        findQuery = {author, draft: false}
    }

    Blog.find(findQuery)
    .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
    .sort({"publishedAt": -1})
    .select("blog_id title des banner activity tags publishedAt -_id")
    .skip((page -1) * maxLimit)
    .limit(maxLimit)
    .then(blogs => {
        return res.status(200).json({blogs});
    })
    .catch(err => {
        return res.status(500).json({"error": err.message });
    })


}

const getCountOfAllLatestBlogs = (req, res) => {

    Blog.countDocuments({ draft: false })
    .then(count => {
        return res.status(200).json( {totalDocs: count} );
    })
    .catch(err => {
        console.log(err.message);
        return res.status(500).json({"error": err.message });
    })

}

const getCountOfSearchingBlogs = (req, res) => {
    let {tag, query, author} = req.body;

    let findQuery;

    if(tag){
        findQuery = {tags: tag, draft: false};
    } else if(query){
        findQuery = {draft: false, title: new RegExp(query, 'i')}
    } else if(author){
        findQuery = {author, draft: false}
    }

    Blog.countDocuments(findQuery)
    .then(count => {
        return res.status(200).json( {totalDocs: count} );
    })
    .catch(err => {
        console.log(err.message);
        return res.status(500).json({"error": err.message });
    })
}

const getBlog = (req, res) => {

    let {blog_id} = req.body;
    let increamentVal = 1;

    Blog.findOneAndUpdate({blog_id} , {$inc: {"activity.total_reads": increamentVal}})
    .populate("author", "personal_info.fullname personal_info.username personal_info.profile_img")
    .select("title des content banner activity publishedAt blog_id tags")
    .then(blog => {
       
        User.findOneAndUpdate({"personal_info.username": blog.author.personal_info.username}, {$inc: {"account_info.total_reads": increamentVal}
        })
        .catch(err => {
            return res.status(500).json({"error": err.message})
        })
        return res.status(200).json({blog});
    })
    .catch(err => {
        return res.status(500).json({"error": err.message });
    })

}

const ocr = (req, res) => {

   let {image, language} = req.body;

//    let pythonProcess = spawn('python', ['./ocr.py', image, language]);

//    let result = [];

//    pythonProcess.stdout.on('data', (data) => {
//         result += data.toString();
//    })

//    pythonProcess.stderr.on('data', (data) => {
//         let output = data.toString();
        
//         try {
//             result = JSON.parse(output);
//         } catch (error) {
//             console.error('Error parsing OCR results:', error);
//         }
//    })

//    pythonProcess.on('close', (code) => {
//         if(code !== 0){
//             console.log(`child process exited with code ${code}`);
//         }
//         else{
//             res.json(result);
//         }
       
//    })


}




export {upLoadImages, createBlog, getLatestBlogs, getTrendingBlogs, getSearchingBlogs, getCountOfAllLatestBlogs, getCountOfSearchingBlogs, getBlog, ocr};