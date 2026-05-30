const createMockRes = () => {
  const res = {
    locals: {},
    statusCode: 200,
    body: undefined,
    cookies: [],
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      this.body = code;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    },
  };
  return res;
};

const createThenableQuery = (value) => {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    select() {
      return query;
    },
    lean() {
      return query;
    },
    exec() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(value).catch(reject);
    },
  };
  return query;
};

module.exports = {
  createMockRes,
  createThenableQuery,
};
