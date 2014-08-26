
lib/parser.js: grammar/zoidberg.pegjs
	./node_modules/.bin/pegjs $< $@
