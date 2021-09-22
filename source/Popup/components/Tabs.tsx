import * as React from 'react';

type Props = {
  content: [string, React.ReactElement][];
  defaultTab?: string;
};

type State = {
  selectedTab: string;
};

export default class Tabs extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = { selectedTab: props.defaultTab ?? props.content[0][0] };
  }

  render(): React.ReactNode {
    const selectedContent = this.props.content.find(
      ([tabName]) => tabName === this.state.selectedTab,
    )?.[1];

    return (
      <div className="tabs-container">
        <div className="tab-chooser">
          {this.props.content.map(([tabName], i) => {
            const selected = tabName === this.state.selectedTab;
            const notLast = i < this.props.content.length - 1;
            const nextSelected =
              notLast &&
              this.props.content[i + 1][0] === this.state.selectedTab;

            const needsRightBorder = notLast && !selected && !nextSelected;

            const classes = [
              ...(selected ? ['selected'] : []),
              ...(needsRightBorder ? ['needs-right-border'] : []),
            ];

            return (
              <div key={tabName} className={classes.join(' ')}>
                {tabName}
              </div>
            );
          })}
        </div>
        <div className="selected-content">{selectedContent}</div>
      </div>
    );
  }
}
