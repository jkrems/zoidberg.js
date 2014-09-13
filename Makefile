
default: build

build: grammar/zoidberg.js

test: build
	npm test

grammar/zoidberg.js: grammar/zoidberg.pegjs
	./node_modules/.bin/pegjs <$< >$@

clean:
	rm lib/parser.js

tmp/hello.js: example/hello.berg build
	./bin/zbc $< >$@

tmp/enum.js: example/enum.berg build
	./bin/zbc $< >$@

tmp/greet.js: example/greet.berg build
	./bin/zbc $< >$@

tmp/integer.js: example/integer.berg build
	./bin/zbc $< >$@

.PHONY: hello
hello: tmp/hello.js
	@node --harmony tmp/hello.js

.PHONY: enum
enum: tmp/enum.js
	@echo "--- Source ---"
	@cat tmp/enum.js
	@echo ""
	@echo "--- Execution --"
	@node --harmony tmp/enum.js

.PHONY: greet
greet: tmp/greet.js
	@echo "--- Source ---"
	@cat tmp/greet.js
	@echo ""
	@echo "--- Execution --"
	@node --harmony tmp/greet.js Joe 3

.PHONY: integer
integer: tmp/integer.js
	@echo "--- Source ---"
	@cat tmp/integer.js
	@echo ""
	@echo "--- Execution --"
	@node --harmony tmp/integer.js
