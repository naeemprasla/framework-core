import test from "node:test";
import assert from "node:assert/strict";
import { JobRegistry } from "../src/core/jobs/job-registry.js";
import { JobQueue } from "../src/core/jobs/job-queue.js";

test("durable job enqueue persists instead of process memory", async()=>{
  const calls=[]; const database={ query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};} };
  const registry=new JobRegistry(); registry.register({id:"test.job",handler:async()=>{}});
  const queue=new JobQueue({registry,database,logger:{error(){}}});
  const job=await queue.enqueue("test.job",{x:1});
  assert.match(job.id,/^job_/); assert.equal(calls.length,1); assert.match(calls[0].sql,/INSERT INTO infrastructure\.jobs/);
});
