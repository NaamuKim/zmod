import { injectable } from "inversify";

@injectable()
class UserService {
  getUser(id: string) {
    return { id };
  }
}

@injectable()
class OrderService {
  getOrder(id: string) {
    return { id };
  }
}
