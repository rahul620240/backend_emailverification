const express=require('express');
const router=express.Router();

//mongoose user model
const User=require('./../models/User');

//mongoose user  verification model
const UserVerificatoin=require('./../models/UserVerification');

//email handler
const nodemailer=require("nodemailer");

//unique string
const {v4:uuidv4}=require("uuid");

//env variables
require("dotenv").config();



//Paaword Handler
const bcrypt=require('bcrypt');


//path for the static verification page
const path=require("path");


//nodemailer stuff
let transporter=nodemailer.createTransport({
  service:"gmail",
  auth:{
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  }

})

//testing success
transporter.verify((error,success)=>{
   if(error){
    console.log(error);
   }else{
    console.log("Ready for messages");
    console.log(success);
   }


})





//Signup
router.post('/signup',(req,res)=>{
    let {name,email,password,dateOfBirth}=req.body;
    name=name.trim();
    email=email.trim();
    password=password.trim();
    dateOfBirth=dateOfBirth.trim();

      if(name==""||email==""||password==""||dateOfBirth==""){
           res.json({
                   status:"FAILED",
                   message:"Empty input field!"
           });


      }else if(!/^[a-zA-Z]*$/.test(name)){
             res.json({
                status:"FAILED",
                message:"Invaid name entered"
             })
         

      }else if(!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)){
        res.json({
            status:"FAILED",
            message:"Invalid email enterned"
        })
      
    }else if(!new Date(dateOfBirth).getTime()){
       res.json({
        status:"FAILED",
        message:"Invalid date of birth enterned"

       })

    }else if(password.lenght<8){
        res.json({
            status:"FAILED",
            message:"Password is too short!!"
        })
    }else {
     //checking if user already exists

     User.find({email}).then(result=>{
       if (result.length){
        //A user already exist 
      
         res.json({
            status:"FAILED",
            message:"User with the provided email already exist"
         })


       }else{
         //Try to create new user


         //password handling
       const saltRounds=10;
       bcrypt.hash(password,saltRounds).then(hashedPassword=>{
               const newUser=new User({
                name,
                email,
                password:hashedPassword,
                dateOfBirth,
                verified:false,
               });

               newUser.save().then(result=>{
                  //handle account verifiacation
                  sendVerificationEmail(result,res);

               })
              .catch(err=>{
                res.json({
                    status:"FAILED",
                    message:"An error occurred while saving user account !!"
                })
              })



       })
        .catch(err=>{
            res.json({
                status:"FAILED",
                message:"An error occurred while hashing password!"
            })


        })


       }


     }).catch(err=>{
        console.log(err);
        res.json({
            status:"FAILED",
            message:"An error occurrd while checking for existing user!!"


        })
     })


    }

})


//send verification email
const sendVerificationEmail=({_id,email},res)=>{
//url to be used in the email

const currentUrl="http://localhost:5000/";

const uniqueString=uuidv4()+_id;

//mail options


const mailOption={
     from:process.env.AUTH_EMAIL,
      to:email,
      subject:"verify your Email",
      html:`<p>Verify your email address to complete the signup and login into your account</p><p>This link 
      <b>exprires in 6 hours</b></p><p>Press <a href=${currentUrl+"user/verify/"+_id+"/"+uniqueString}>here</a>to procced.</p>`

};
//hash the uniqueString

const saltRounds=10;
bcrypt
.hash(uniqueString,saltRounds)
.then((hashedUniqueString)=>{

//set values in userVerification collection
const newVerificaton=new UserVerificatoin({
   userId:_id,
   uniqueString:hashedUniqueString,
   createdAt:Date.now(),
   expiresAt:Date.now()+21600000,

});

newVerificaton
.save()
.then(()=>{
    transporter
      .sendMail(mailOption)
      .then(()=>{
        //email sent and verification record saved
        res.json({
            status:"PENDING",
            message:"verification email sent",
       });

      })
      .catch((error)=>{
        console.log(error);
        res.json({
            status:"FAILED",
            message:"Couldn't save verification email data!",
       });
      })

})
.catch((error)=>{
    console.log(error);
    res.json({
         status:"FAILED",
         message:"Couldn't save verification email data!",
    });
})


})
.catch(()=>{
    res.json({
        status:"FAILED",
        message:"An error occured while hashing email detail",
    })

})


};


//verify  email
router.get("/verify/:userId/:uniqueString",(req,res)=>{
let {userId,uniqueString}=req.params;
   
UserVerificatoin
 .find({userId})
 .then((result)=>{
     if (result.length>0){
        //user verification record exist so we procced
     
        const {expiresAt}=result[0];
        const hashedUniqueString=result[0].uniqueString;

      
      //checking for expired
      if(expiresAt<Date.now()){
        //record has exprired so we delete it 
        UserVerificatoin
        .deleteOne({userId})
        .then(result=>{
           UserVerificatoin
           .deleteOne({userId})
           .then(result=>{
                  User
                  .deleteOne({_id:userId})
                  .then(()=>{
                    let message="Link has exprired .Please sign up again.";
                    res.redirect(`/user/verified/error=true&message=${message}`) 
                  })
                  .catch(error=>{
                    let message="Clearing user with expired uniquie string failed";
                    res.redirect(`/user/verified/error=true&message=${message}`) 
                  })

           })
            



        })
        .catch((error)=>{
            console.log(error);
            let message="An error occured while clearing exprires user verification record";
            res.redirect(`/user/verified/error=true&message=${message}`) 
        })

      }else{
        //valid record exists so we validate the user string
        //First compare the hashed  unique string

        bcrypt.compare(uniqueString,hashedUniqueString) 
        .then((result)=>{
            if(result){
                //strings match
            
            User
             .updateOne({_id:userId},{verified:true})
             .then(()=>{
                   UserVerificatoin
                   .deleteOne({userId})
                   .then(()=>{
                    
                    res.sendFile(path.join(__dirname,"./../views/verified.html"))
                   })
                   .catch(error=>{
                    console.log(error);
                let message=" An error occurred while finalizing successful verification.";
                res.redirect(`/user/verified/error=true&message=${message}`);
                   })
             })
             .catch(error=>{
                console.log(error);
                let message=" An error occured while updating user record to show verified.";
                res.redirect(`/user/verified/error=true&message=${message}`) ;
             })



            }else{
               //existing record but incorrect verification details passed.
               let message=" Invaild verification deatails passed .Check your inbox .";
               res.redirect(`/user/verified/error=true&message=${message}`) 


            }
        })
        .catch(error=>{
            let message=" An error occurred while comparing unique strings.";
   res.redirect(`/user/verified/error=true&message=${message}`) 
        })

      }

     }else{
// user verification record doesn't exist
let message="Account record doesn't exist or has been verified already.Please sign up or log in ";
   res.redirect(`/user/verified/error=true&message=${message}`)  


     }

 })
 .catch((error)=>{
  console.log(error);
   let message="An error occurred while checking for the existing user verification record";
   res.redirect(`/user/verified/error=true&message=${message}`)  
 })
});



//verification page route
router.get("/verified",(req,res)=>{
res.sendFile(path.join(__dirname,"./../views/verified.html"));
})







//signin

router.post('/signin',(req,res)=>{
    let {email,password}=req.body;
    
    email=email.trim();
    password=password.trim();
    
    if(email==""||password==""){
        res.json({
            status:"FAILED",
            message:"Empty credentials supplied"
        })
    }else{

        //check if user exist
       User.find({email})
       .then(data=>{
        if(data){
            //user exists

            //check if user is verified

            if(!data[0].verified){
                res.json({
                    status:"FAILED",
                    message:"Email hasn't been verified yet .check your inbox",
                    
                })
            }else{
                const hashedPassword=data[0].password;
                bcrypt.compare(password,hashedPassword).then(result=>{
                    if (result){
                        // password match
                        res.json({
                            status:"SUCCESS",
                            message:"Signin successful",
                            data:data
                        })
                    }else{
                        res.json({
                            status:"FAILED",
                            message:"Invalid password entered!!",
                            
                        })
                    }
                })
                .catch(err=>{
                    res.json({
                        status:"FAILED",
                        message:"Invalid credentials password entered!!",
                        
                    })
            
            
                })
            }


          
        }else{
            res.json({
                status:"FAILED",
                message:"Invalid credentials  entered!!",
                
            })

        }
       })
       .catch(err=>{
        res.json({
            status:"FAILED",
            message:"An error occurred while checking for existing user",
            
        })

       })

    }  





})

module.exports=router;
