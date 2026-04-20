import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import Colors from '@/constants/Colors';
import { getDaysInMonth, format, getDate } from 'date-fns';
import { calculateEarnings } from '@/utils/calculations'; // Твоя функция расчета

interface Shift {
    id: string | number;
    date: string;
    start_time: string;
    end_time: string;
    hourly_rate: number;
    extra_payment: number;
    break?: number | null;
}

interface MonthlyChartProps {
    shifts: Shift[];
    currentDate: Date;
    includeNdfl: boolean;
    applyNdfl: (amount: number, include: boolean) => number;
}

export default function MonthlyChart({ shifts, currentDate, includeNdfl, applyNdfl }: MonthlyChartProps) {
    const screenWidth = Dimensions.get('window').width;

    const chartData = useMemo(() => {
        const daysInMonth = getDaysInMonth(currentDate);
        const monthPrefix = format(currentDate, 'yyyy-MM');

        const dailyEarnings = new Array(daysInMonth).fill(0);

        shifts.forEach(shift => {
            if (shift.date.startsWith(monthPrefix)) {
                const dayIndex = getDate(new Date(shift.date)) - 1;
                const start = shift.start_time?.split(':').slice(0, 2).join(':');
                const end = shift.end_time?.split(':').slice(0, 2).join(':');

                const gross = calculateEarnings(
                    start,
                    end,
                    shift.hourly_rate ?? 0,
                    shift.extra_payment ?? 0,
                    shift.break ?? 0
                );

                dailyEarnings[dayIndex] += applyNdfl(gross, includeNdfl);
            }
        });

        const maxEarning = Math.max(...dailyEarnings);

        return dailyEarnings.map((val, index) => {
            const isMax = val === maxEarning && val > 0;
            return {
                value: val,
                label: (index + 1).toString(),

                frontColor: isMax ? Colors.success : Colors.primary,

                topLabelComponent: () => (
                    val > 0 ? (
                        <Text style={{ color: Colors.gray, fontSize: 9, marginBottom: 4 }}>
                            {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
                        </Text>
                    ) : null
                )
            };
        });
    }, [shifts, currentDate, includeNdfl, applyNdfl]);

    const rawMaxValue = Math.max(...chartData.map(d => d.value));

    // Функция для расчета ровных и красивых шагов (1k, 2k, 5k и тд)
    const getNiceScale = (max: number, sections: number) => {
        if (max === 0) return { niceMax: 4000, niceStep: 1000 };

        // Даем 10% запаса сверху, чтобы самый высокий столбик не упирался в потолок
        const targetMax = max * 1.1;
        const roughStep = targetMax / sections;
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalizedStep = roughStep / magnitude;

        let niceMultiplier;
        if (normalizedStep <= 1) niceMultiplier = 1;
        else if (normalizedStep <= 2) niceMultiplier = 2;
        else if (normalizedStep <= 2.5) niceMultiplier = 2.5;
        else if (normalizedStep <= 5) niceMultiplier = 5;
        else niceMultiplier = 10;

        const niceStep = niceMultiplier * magnitude;
        return {
            niceStep,
            niceMax: niceStep * sections
        };
    };

    const sectionsCount = 4;
    const { niceMax, niceStep } = getNiceScale(rawMaxValue, sectionsCount);

    return (
        <View style={styles.card}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>Доход по дням</Text>
                {rawMaxValue > 0 && (
                    <Text style={styles.swipeHint}>Листайте ↔</Text>
                )}
            </View>

            {rawMaxValue === 0 ? (
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyText}>В этом месяце пока нет дохода</Text>
                </View>
            ) : (
                <View style={styles.chartWrap}>
                    <BarChart
                        data={chartData}
                        barWidth={16}
                        spacing={12}
                        roundedTop
                        roundedBottom
                        hideRules
                        xAxisThickness={0}
                        yAxisThickness={0}
                        yAxisTextStyle={{ color: Colors.gray, fontSize: 10 }}
                        noOfSections={sectionsCount}
                        maxValue={niceMax}
                        stepValue={niceStep}
                        isAnimated
                        animationDuration={800}
                        width={screenWidth - 80}
                        initialSpacing={10}
                        xAxisLabelTextStyle={{ color: Colors.gray, fontSize: 10 }}
                        formatYLabel={(label) => {
                            const val = Number(label);
                            if (val >= 1000) {
                                return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`;
                            }
                            return label;
                        }}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
        marginHorizontal: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.darkGray,
    },
    swipeHint: {
        fontSize: 12,
        color: Colors.gray,
        fontWeight: '500',
        backgroundColor: Colors.lightGray,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    chartWrap: {
        overflow: 'hidden',
    },
    emptyWrap: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.gray,
        fontSize: 14,
    }
});