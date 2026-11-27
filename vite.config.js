import adapter from "@sveltejs/adapter-vercel";
import { sveltekit } from "@sveltejs/kit/vite";

// Windows without Developer Mode (and without "SeCreateSymbolicLinkPermission")
// aborts the build with EPERM when Vite tries to create a symlink inside
// node_modules/.vite-temp for the bundled config file. Forcing the OS to fall
// back to NTFS junctions/mount points sidesteps that privilege requirement.
// https://vite.dev/guide/troubleshooting#_case-2-eperm-operation-not-permitted-on-windows
if (process.platform === "win32") {
  process.env.VITE_CJS_IGNORE_WARNING ||= "true";
  process.env.USE_WINDOWS_JUNCTION = "true";
}

const config = {
  plugins: [
    sveltekit({
      adapter: adapter(),
    }),
  ],
};

export default config;
