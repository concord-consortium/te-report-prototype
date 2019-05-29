# T.E. Report Prototype

Teacher Edition report prototyping and experiments.

## Purpose

To see about hacking out an approximation to a Teacher Edition report give two
inputs:

* a file export of an activity; and,

* a JSON formated extraction from the log-puller.

## Executing `main()`

``` bash
te-report-prototype$ npm run exec main.ts
```

## Structure

This really couldn't be simpler. In the root of the repository is a TypeScript
source file, `main.ts`. Edit this file to import whatever scripts you've
written in the `./scripts` directory and call whatever you want from within
the `main()` function in `main.ts`.

## Running Tests

Jest is setup in this repository. To run the tests, simply use

``` bash
te-report-prototype$ npm test
```

The test files are intended to be parallel to the file they are testing, in the
`./scripts` directory. For Jest to find and run them, they must have file names
ending with `.test.ts`.
