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
    cssmin: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
      },
      dist: {
        files: {
          'public/css/app.min.css': ['public/css/app.css']
        }
      }
    },
    csslint: {
      src: ['public/css/app.css'],
      options: {
        "important": false,
        "box-model": false,
        "known-properties": false,
        "overqualified-elements":false
      }
    },
    watch: {
      files: ['public/js/app.js', 'public/css/app.css'],
      tasks: ['uglify', 'jshint', 'cssmin', 'csslint']
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-csslint');

  grunt.registerTask('default', ['uglify', 'jshint', 'cssmin', 'csslint']);

};
