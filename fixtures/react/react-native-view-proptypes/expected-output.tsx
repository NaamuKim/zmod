var React = require("react-native");
var { View, Text, PropTypes, ViewPropTypes } = React;

var styles = {
  container: {
    flex: 1,
  },
};

var MyComponent = React.createClass({
  propTypes: {
    style: ViewPropTypes.style,
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
