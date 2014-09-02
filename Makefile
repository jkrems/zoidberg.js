
lib/peg-parser.js: grammar/zoidberg.pegjs
	./node_modules/.bin/pegjs <$< >$@
