import { send as dispatch } from "./api";

function run(options: unknown) {
  dispatch("wrong", options);
}
