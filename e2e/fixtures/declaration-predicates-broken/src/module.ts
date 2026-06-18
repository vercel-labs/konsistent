interface BaseInterface {}
class BaseClass {}
interface Serializable {}

interface LocalConfig {}
interface LocalResult {}

export type LocalType = string;
export const localConstant = "value";

export function createLocal(config: LocalConfig): LocalResult {
  return config as LocalResult;
}

export interface LocalInterface extends BaseInterface {}

export class LocalClass extends BaseClass implements Serializable {}
