var message=null;
var app = new Vue({
    el: '#app',
    data: function () {
        return {message};
      },
      mounted: function () {
          this.query()
       },
      methods: {
        query: function () {
        this.$http.get('https://xoxo-news.herokuapp.com/news/').then(response => {

          this.message = response.body;
        }, response => {
        });
        }
      }
  })

