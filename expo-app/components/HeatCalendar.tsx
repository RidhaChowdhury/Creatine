import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";

type CommitData = {
  date: string;
  count: number;
};

type MonthLabel = {
  month: number;
  colIndex: number;
  name: string;
};

type Props = {
  values: CommitData[];
  endDate: Date;
  numDays: number;
};

const HeatCalendar = ({ values, endDate, numDays }: Props) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const numColumns = Math.ceil(numDays / 7);
  const squareSize = containerWidth / numColumns;

  // Generate array of dates
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - numDays + 1);

  const dates = Array.from({ length: numDays }, (_, i) => {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    return date;
  });

  // Group dates into columns
  const columns = Array.from({ length: numColumns }, (_, i) =>
    dates.slice(i * 7, (i + 1) * 7)
  );

  // Calculate month labels with proper typing
  const monthLabels: MonthLabel[] = [];
  let currentMonth = -1;
  columns.forEach((col, colIndex) => {
    const month = col[0].getMonth();
    if (month !== currentMonth) {
      monthLabels.push({
        month,
        colIndex,
        name: col[0].toLocaleString("default", { month: "short" }),
      });
      currentMonth = month;
    }
  });

  // Get color based on commit count
  const getColor = (count: number) => {
    if (count === 0) return "#ebedf0";
    if (count < 3) return "#9be9a8";
    if (count < 5) return "#40c463";
    if (count < 8) return "#30a14e";
    return "#216e39";
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Month labels */}
      <View style={styles.monthContainer}>
        {monthLabels.map((label, i) => (
          <Text
            key={i}
            style={[styles.monthLabel, { left: label.colIndex * squareSize }]}
          >
            {label.name}
          </Text>
        ))}
      </View>

      {/* Contribution grid */}
      <View style={styles.grid}>
        {columns.map((column, colIndex) => (
          <View key={colIndex} style={styles.column}>
            {column.map((date, rowIndex) => {
              const dateStr = date.toISOString().split("T")[0];
              const commit = values.find((v) => v.date === dateStr);
              return (
                <View
                  key={rowIndex}
                  style={[
                    styles.cell,
                    {
                      width: squareSize,
                      height: squareSize,
                      backgroundColor: getColor(commit?.count || 0),
                    },
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    aspectRatio: 16 / 9,
    paddingTop: 20,
  },
  monthContainer: {
    height: 20,
    marginBottom: 5,
  },
  monthLabel: {
    position: "absolute",
    fontSize: 10,
    color: "#666",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  column: {
    marginHorizontal: 1,
  },
  cell: {
    marginVertical: 1,
    borderRadius: 2,
  },
});

export default HeatCalendar;
