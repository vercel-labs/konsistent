import { send as dispatch } from "./api";

function initialize() {}

function run(options: unknown) {
  initialize();
  dispatch("email", options, callback);
  client.send?.("done");
}
