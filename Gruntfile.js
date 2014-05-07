module.exports = function(grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          'public/js/app.min.js': ['public/js/app.js']
        }
      }
    },
    jshint: {
      files: ['Gruntfile.js', 'public/js/app.js'],
      options: {
        globals: {
          jQuery: true,
          console: true,
          module: true,
          document: true,
        },
          multistr: true
      }
    },
    watch: {
      files: ['public/js/app.js'],
      tasks: ['jshint','uglify']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['uglify']);

};
