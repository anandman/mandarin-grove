// Preserve the web endpoint's original same-origin contract.
const {createHandler}=require('../server/feedback.cjs');
module.exports=createHandler();
module.exports.createHandler=createHandler;
