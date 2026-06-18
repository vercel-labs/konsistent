interface BaseInterface {}
class BaseClass {}
interface Serializable {}

interface LocalConfig {}
interface LocalResult {}

type LocalType = string;
const localConstant = "value";

function createLocal(config: LocalConfig): LocalResult {
  return config as LocalResult;
}

interface LocalInterface extends BaseInterface {}

class LocalClass extends BaseClass implements Serializable {}
