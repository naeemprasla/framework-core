import test from "node:test";
import assert from "node:assert/strict";
import { shouldAutoOpenSetup, openUrlInDefaultBrowser } from "../src/core/setup/setup-browser.js";

test("setup browser auto-open is enabled only for safe local development URLs",()=>{
  assert.equal(shouldAutoOpenSetup({env:"development",baseUrl:"http://localhost:3000",enabled:true,ci:false}),true);
  assert.equal(shouldAutoOpenSetup({env:"development",baseUrl:"http://127.0.0.1:3000",enabled:true,ci:false}),true);
  assert.equal(shouldAutoOpenSetup({env:"production",baseUrl:"https://example.com",enabled:true,ci:false}),false);
  assert.equal(shouldAutoOpenSetup({env:"development",baseUrl:"http://192.168.1.50:3000",enabled:true,ci:false}),false);
  assert.equal(shouldAutoOpenSetup({env:"development",baseUrl:"http://localhost:3000",enabled:false,ci:false}),false);
  assert.equal(shouldAutoOpenSetup({env:"test",baseUrl:"http://localhost:3000",enabled:true,ci:false}),false);
  assert.equal(shouldAutoOpenSetup({env:"development",baseUrl:"http://localhost:3000",enabled:true,ci:true}),false);
});

test("browser opener uses platform-native command without a shell",()=>{
  const calls=[];
  const spawnImpl=(command,args,options)=>{calls.push({command,args,options});return {unref(){}};};
  assert.equal(openUrlInDefaultBrowser("http://localhost:3000/setup?token=x",{platform:"linux",spawnImpl}),true);
  assert.equal(calls[0].command,"xdg-open");
  assert.deepEqual(calls[0].args,["http://localhost:3000/setup?token=x"]);
  assert.equal(calls[0].options.detached,true);
  assert.equal(calls[0].options.stdio,"ignore");
  assert.equal("shell" in calls[0].options,false);
});
