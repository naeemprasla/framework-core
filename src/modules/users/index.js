const service = {
  module: "users",
  async execute(input, context={}) { return { ok:true, module:"users", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("users.profile.read", service, { owner:"framework.users" });
    ctx.health.register("module:framework.users", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};
