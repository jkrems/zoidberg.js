assert = require 'assertive'

runCode = require './run-code'

describe 'match adt', ->
  beforeEach runCode """
    List(t) = enum { Node(value: t, next: List(t)), Empty() }
    length(list) = match list {
      List.Node(value, next) => 1 + length(next)
      List.Empty() => 0
    }
    myList = List.Node(10, List.Node(42, List.Node(9, List.Empty())))
    main() = {
      printf("Length: %j", length(myList));
      0
    }
    """

  xit 'prints hello world', ->
    assert.equal 'Length: 3\n', @stdout
