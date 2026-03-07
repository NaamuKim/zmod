var React = require("react-native");
var { View, Text, PropTypes } = React;

var styles = {
  container: {
    flex: 1,
  },
};

var MyComponent = React.createClass({
  propTypes: {
    style: View.propTypes.style,
    name: PropTypes.string,
  },
  render: function () {
    return (
      <View style={styles.container}>
        <Text>{this.props.name}</Text>
      </View>
    );
  },
});
