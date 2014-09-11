
default: build

build: lib/parser.js

test: build
	npm test

lib/parser.js: grammar/zoidberg.pegjs
	./node_modules/.bin/pegjs <$< >$@

clean:
	rm lib/parser.js

example/enum.berg: build
	./bin/zb $@
