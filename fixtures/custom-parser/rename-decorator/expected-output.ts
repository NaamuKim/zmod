import { singleton } from "inversify";

@singleton()
class UserService {
  getUser(id: string) {
    return { id };
  }
}

@singleton()
class OrderService {
  getOrder(id: string) {
    return { id };
  }
}
