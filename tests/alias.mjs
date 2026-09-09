// Registers the "@/" resolver. Loaded via --import by tests/run.mjs.
import { register } from "node:module"
register("./alias-hooks.mjs", import.meta.url)
