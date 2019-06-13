# T.E. Report Prototype

Teacher Edition report prototyping and experiments.

## Purpose

To see about hacking out an approximation to a Teacher Edition report given 3
types inputs (all found in the `./input-data` directory):

* a JSON extraction from the log-puller for all the source of events;

* a JSON formated extraction from LARA for all the activities reference in the
  log;

* a set of "user definitions" to simulate user data from the Portal.


## Executing `main()`

``` bash
te-report-prototype$ npm run exec ./main.ts
```

Produces output as CSV file(s) in `output-data`. Also produces all sorts of
debugging messages on stdout, while it runs.

In the root of the repository is a TypeScript
source file, `main.ts`. Edit this file to import whatever scripts you've
written in the `./scripts` directory and call whatever you want from within
the `main()` function in `main.ts`.

## Running Tests

Although there aren't any tests at present, Jest is setup in this repository.
To run the tests, simply use

``` bash
te-report-prototype$ npm test
```

The test files are intended to be parallel to the file they are testing, in the
`./scripts` directory. For Jest to find and run them, they must have file names
ending with `.test.ts`.
