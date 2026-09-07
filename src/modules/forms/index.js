const service = {
  module: "forms",
  async execute(input, context={}) { return { ok:true, module:"forms", input, context:{appId:context.appId??null,tenantId:context.tenantId??null} }; }
};
export default {
  async register(ctx) {
    ctx.capabilities.register("forms.schema.validate", service, { owner:"framework.forms" });
    ctx.health.register("module:framework.forms", async()=>({ok:true}), {critical:false});
  },
  async boot() {},
  async health() { return {status:"healthy"}; }
};
