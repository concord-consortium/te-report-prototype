import { getMessage } from "./first-script"

describe("first-script", () => {

  describe("announce()", () => {

    it("has the word, Hello, in its message", () => {
      expect(getMessage()).toContain("Hello");
    });
  
  });
  
});
