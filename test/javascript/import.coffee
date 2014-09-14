assert = require 'assertive'

runCode = require './run-code'

describe 'match adt', ->
  beforeEach runCode """
    import "fs"
    main() = {
      printf(
        fs.readFileSync("example/files/hello.txt", "utf8"));
      0
    }
    """

  it 'finds out the length of the list', ->
    assert.equal 'Hello.\n\n', @stdout
