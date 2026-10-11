package com.cryptalk.coin;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CommunityStatisticsConfig {
    @Bean
    Clock communityStatisticsClock() {
        return Clock.systemUTC();
    }
}
