
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
