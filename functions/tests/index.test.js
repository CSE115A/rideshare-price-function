/* eslint-disable prefer-promise-reject-errors */
const { getPrices } = require("../index");
const mockConfig = require("firebase-functions-test")();
const { request, response } = require("./constants");
const { getLyftPrices } = require("../middleware/lyft");
const { getUberPrices } = require("../middleware/uber");
const { authenticateToken } = require("../middleware/middleware");
jest.mock("../middleware/lyft");
jest.mock("../middleware/uber");
jest.mock("../middleware/middleware");

mockConfig.mockConfig({
  getprices: {
    uber_endpoint: "www.test.com",
    lyft_endpoint: "www.test1.com",
  },
});

describe("getPrices Testing Suite", () => {
  beforeEach(() => {
    response.status().send({ undefined });
  });

  describe("when validating", () => {
    beforeEach(() => {
      response.status().send({ undefined });
    });

    describe("if incorrect token is supplied", () => {
      authenticateToken.mockImplementationOnce(() => {
        return {
          isAuthError: true,
          authStatusCode: 401,
          authMessage: "Wrong Token",
        };
      });
      it("returns 401", async () => {
        await getPrices(request, response);
        expect(response.statusCode).toEqual(401);
        expect(response.body.error).toBeTruthy();
        expect(response.body.status).toEqual(401);
        expect(response.body.message).toBe("Wrong Token");
      });
    });
    describe("if token is unset in environment", () => {
      authenticateToken.mockImplementationOnce(() => {
        return {
          isAuthError: true,
          authStatusCode: 500,
          authMessage: "Unset Env Var",
        };
      });
      it("returns 500 error message with correct fields", async () => {
        await getPrices(request, response);
        expect(response.statusCode).toEqual(500);
        expect(response.body.error).toBeTruthy();
        expect(response.body.status).toEqual(500);
        expect(response.body.message).toBe("Unset Env Var");
      });
    });
  });

  describe("when given incomplete params", () => {
    beforeEach(() => {
      response.status().send({ undefined });
    });
    describe("when lyft's params are invalid", () => {
      authenticateToken.mockImplementationOnce(() => {
        return { isAuthError: false };
      });
      getLyftPrices.mockImplementationOnce(() =>
        Promise.resolve({
          status: 400,
          message: "Lyft: Incorrect Params",
        }),
      );
      it("should return 400 bad request error message", async () => {
        request.query = {
          start_lat: 123,
          start_lng: 123,
        };
        await getPrices(request, response);
        expect(response.body.status).toEqual(400);
        expect(response.body.error).toBeTruthy();
        expect(response.body.message).toBe("Lyft: Incorrect Params");
        expect(response.statusCode).toBe(400);
      });
    });

    describe("when uber's params are invalid", () => {
      authenticateToken.mockImplementationOnce(() => {
        return { isAuthError: false };
      });
      getLyftPrices.mockImplementationOnce(() => Promise.resolve(true));
      getUberPrices.mockImplementationOnce(() =>
        Promise.resolve({ status: 400, message: "Uber: Missing Params" }),
      );

      it("throws a 400 error bad request", async () => {
        request.query = {
          start_lat: 123,
          start_lng: 123,
        };

        request.headers = {
          authentication: "token",
        };

        await getPrices(request, response);
        expect(response.statusCode).toEqual(400);
        expect(response.body.error).toBeTruthy();
        expect(response.body.status).toEqual(400);
        expect(response.body.message).toBe("Uber: Missing Params");
      });
    });
  });

  describe("when given correct params", () => {
    authenticateToken.mockImplementationOnce(() => {
      return { isAuthError: false };
    });
    getLyftPrices.mockImplementationOnce(() =>
      Promise.resolve({
        status: 200,
        message: [{ displayName: "Lyft", price: "$10-12" }],
      }),
    );
    getUberPrices.mockImplementationOnce(() =>
      Promise.resolve({
        status: 200,
        message: [{ displayName: "Uber", price: "$12-14" }],
      }),
    );

    it("returns 200 successful response with appropriate fields", async () => {
      await getPrices(request, response);
      expect(response.statusCode).toEqual(200);
      expect(response.body.error).toBeFalsy();
      expect(response.body.status).toEqual(200);
      expect(response.body.message).toStrictEqual({
        lyft: [{ displayName: "Lyft", price: "$10-12" }],
        uber: [{ displayName: "Uber", price: "$12-14" }],
      });
    });
  });

  describe("when server side error happens", () => {
    beforeEach(() => {
      response.status().send({ undefined });
    });
    request.query = {
      start_lat: 123,
      start_lng: 123,
      end_lat: 123,
      end_lng: 123,
    };
    describe("with uber", () => {
      authenticateToken.mockImplementationOnce(() => {
        return { isAuthError: false };
      });
      getLyftPrices.mockImplementationOnce(() =>
        Promise.resolve({
          status: 200,
          message: [{ displayName: "Lyft", price: "$10-12" }],
        }),
      );
      getUberPrices.mockImplementationOnce(() =>
        Promise.reject(new Error("Missing Token")),
      );

      it("throws a 500 error pointing", async () => {
        await getPrices(request, response);
        expect(response.statusCode).toEqual(500);
        expect(response.body.error).toBeTruthy();
        expect(response.body.status).toEqual(500);
        expect(response.body.message).toBe("Missing Token");
      });
    });

    describe("with Lyft", () => {
      authenticateToken.mockImplementationOnce(() => {
        return { isAuthError: false };
      });
      getLyftPrices.mockImplementationOnce(() =>
        Promise.reject(new Error("Lyft Error")),
      );

      it("throws a 500 error pointing", async () => {
        await getPrices(request, response);
        expect(response.statusCode).toEqual(500);
        expect(response.body.error).toBeTruthy();
        expect(response.body.status).toEqual(500);
        expect(response.body.message).toBe("Lyft Error");
      });
    });
  });
});
