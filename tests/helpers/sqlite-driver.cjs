// A real SQLite file behind the same narrow interface as the native plugin.
const {DatabaseSync}=require('node:sqlite');
function openDriver(file,options={}){
 const sqlite=new DatabaseSync(file,options);
 return {sqlite,
  async execute(sql){sqlite.exec(sql);return {changes:{changes:0}};},
  async run(sql,values=[]){const result=sqlite.prepare(sql).run(...values);return {changes:{changes:Number(result.changes),lastId:Number(result.lastInsertRowid)}};},
  async query(sql,values=[]){return {values:sqlite.prepare(sql).all(...values).map(row=>({...row}))};},
  async beginTransaction(){sqlite.exec('BEGIN IMMEDIATE');return {changes:{changes:0}};},
  async commitTransaction(){sqlite.exec('COMMIT');return {changes:{changes:0}};},
  async rollbackTransaction(){sqlite.exec('ROLLBACK');return {changes:{changes:0}};},
  async isTransactionActive(){return {result:sqlite.isTransaction};},
  async close(){sqlite.close();}
 };
}
module.exports={openDriver};
