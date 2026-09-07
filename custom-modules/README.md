# Custom Modules

Place trusted, developer-authored module packages in this directory. Each module must be a subdirectory containing `module.manifest.json` and its declared entry file. Core discovers these packages at boot and runs them through the same manifest validation, scoped Module SDK, capability, event, job, Admin UI and settings contracts used by official modules.

Custom server-side JavaScript is trusted deployment code. Do not install untrusted packages here; process/container isolation is required for untrusted third-party code.
