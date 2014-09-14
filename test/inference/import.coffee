assert = require 'assertive'

_ = require 'lodash'

Parser = require '../../lib/parser'
TypeSystem = require '../../lib/types'
infer = require '../../lib/inference'

describe 'inference:import', ->
  beforeEach ->
    @typeSystem = TypeSystem()
    {@TypeVariable} = @typeSystem

  describe 'import string', ->
    beforeEach ->
      @ast = Parser.parse 'import "fs"\npkg = fs.readFileSync("package.json")'
      infer @ast, @typeSystem

    # Temporary: no type information for module should throw long-term
    it 'infers pkg to be a TypeVariable', ->
      pkg = _.find @ast.body, name: 'pkg'
      pkgType = @typeSystem.prune pkg.dataType
      assert.truthy 'instanceof TypeVariable',
        (pkgType instanceof @TypeVariable)
