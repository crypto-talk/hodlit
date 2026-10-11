package com.cryptalk.poll;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class PollClockConfig {
    @Bean
    Clock pollClock() { return Clock.systemUTC(); }
}
