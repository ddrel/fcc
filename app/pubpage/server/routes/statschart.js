'use strict';
module.exports = (app)=>{
    app.get("/chart",(req,res)=>{
            res.render("statschart");
    });    
}