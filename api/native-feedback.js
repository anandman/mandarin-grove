// Native reports use a separate origin policy and a minimal upload schema.
const {createNativeHandler}=require('../server/feedback.cjs');
module.exports=createNativeHandler();
module.exports.createHandler=createNativeHandler;
