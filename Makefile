
default: build

build: grammar/zoidberg.js

test: build
	npm test

grammar/zoidberg.js: grammar/zoidberg.pegjs
	./node_modules/.bin/pegjs <$< >$@

clean:
	rm lib/parser.js

example/enum.berg: build
	./bin/zb $@
