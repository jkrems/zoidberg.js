assert = require 'assertive'

runCode = require './run-code'

describe 'a hello world program', ->
  beforeEach runCode """
    main() = { printf("Hello World"); 0 }
    """

  it 'prints hello world', ->
    assert.equal 'Hello World\n', @stdout
