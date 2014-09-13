assert = require 'assertive'

runCode = require './run-code'

describe 'javascript integers', ->
  describe 'division', ->
    beforeEach runCode """
      main() = { printf("9 / 2 = %d", 9 / 2); 0 }
      """

    it 'follows actual integer semantics', ->
      assert.equal '9 / 2 = 4\n', @stdout

  describe 'modulo', ->
    beforeEach runCode """
      main() = { printf("9 % 5 = %d", 9 % 5); 0 }
      """

    it 'follows actual integer semantics', ->
      assert.equal '9 % 5 = 4\n', @stdout
