const report = require('multiple-cucumber-html-reporter');
const os = require('os');
var platformMap={
  "darwin": "osx"
}
var platformName=os.platform()
if(platformMap[os.platform()]) {
  platformName=platformMap[os.platform()]
}


report.generate({
       displayDuration: true,
       metadata:{
        device: 'Local test machine',
        platform: {
            name: platformName,
            version: os.release()
        }
       },
    customData: {
        title: 'Run info',
        data: [
            {label: 'Report Generated:', value: `${new Date()}` }
        ]
    },
	jsonDir: './test/report/', 
        reportPath: `test/report/`,
});
