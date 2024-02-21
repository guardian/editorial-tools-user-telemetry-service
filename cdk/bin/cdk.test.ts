import {OUTDIR_ENV} from "aws-cdk-lib/cx-api";

describe('The riff-raff output YAML', () => {
  it('matches the snapshot', () => {
    // outdir changes for every test execution and didn't want to change cdk.ts too much - so overriding in the test
    process.env[OUTDIR_ENV] = 'cdk.out';
    // eslint-disable-next-line -- this require is necessary because we must set env var before importing riffRaff
    expect(require('./cdk').riffRaff.toYAML()).toMatchSnapshot();
  });
});
