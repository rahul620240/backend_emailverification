const mongoose=require('mongoose');
const Schema=mongoose.Schema;

const UserVerificatoinSchema =new Schema({
    userId:String,
    uniqueString:String,
    createdAt:Date,
    expiresAt:Date,

});


const UserVerificatoin = mongoose.model('UserVerificatoin',UserVerificatoinSchema);

module.exports=UserVerificatoin;